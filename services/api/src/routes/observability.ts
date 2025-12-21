// Observability routes for metrics and health checks
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getPrometheusMetrics } from "../lib/metrics.js";
import { getRecentErrors, getErrorTrackingHealth } from "../lib/errorTracking.js";
import prisma from "../lib/db.js";
import redis from "../lib/redis.js";

const observabilityRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Prometheus-compatible metrics endpoint
   */
  app.get("/metrics", async (_request, reply) => {
    try {
      const metrics = await getPrometheusMetrics();
      reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      return metrics;
    } catch (error) {
      return reply.code(500).send({ error: "Failed to collect metrics" });
    }
  });

  /**
   * Detailed health check with dependencies
   */
  app.get("/health/detailed", async (_request, reply) => {
    const checks: Record<string, { status: "healthy" | "unhealthy"; latencyMs?: number; error?: string }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: "unhealthy", error: String(error) };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await redis.ping();
      checks.redis = { status: "healthy", latencyMs: Date.now() - redisStart };
    } catch (error) {
      checks.redis = { status: "unhealthy", error: String(error) };
    }

    // Error tracking health
    const errorHealth = getErrorTrackingHealth();
    checks.errorTracking = {
      status: "healthy",
      latencyMs: 0,
    };

    // Overall status
    const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

    if (!allHealthy) {
      reply.code(503);
    }

    return {
      status: allHealthy ? "healthy" : "degraded",
      version: "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks,
      errorTracking: errorHealth,
    };
  });

  /**
   * Recent errors endpoint (protected, for debugging)
   */
  app.get(
    "/api/v1/admin/errors",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check if user is admin (for now, just check if they have enterprise plan)
      if (request.userPlan !== "ENTERPRISE") {
        return reply.code(403).send({
          error: "Forbidden",
          message: "Admin access required",
        });
      }

      const errors = getRecentErrors(50);
      return { errors };
    }
  );

  /**
   * Service info endpoint
   */
  app.get("/api/v1/info", async () => {
    return {
      service: "budi-api",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      features: {
        billing: !!process.env.STRIPE_SECRET_KEY,
        pushNotifications: !!process.env.APNS_KEY_ID,
        iap: !!process.env.APPLE_ISSUER_ID,
      },
    };
  });

  /**
   * Queue status endpoint
   */
  app.get(
    "/api/v1/admin/queues",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.userPlan !== "ENTERPRISE") {
        return reply.code(403).send({
          error: "Forbidden",
          message: "Admin access required",
        });
      }

      try {
        const queues = ["jobs", "dsp-jobs", "codec-jobs"];
        const status: Record<string, number> = {};

        for (const queue of queues) {
          status[queue] = await redis.llen(queue);
        }

        return { queues: status };
      } catch (error) {
        return reply.code(500).send({ error: "Failed to get queue status" });
      }
    }
  );

  /**
   * Database stats endpoint
   */
  app.get(
    "/api/v1/admin/stats",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.userPlan !== "ENTERPRISE") {
        return reply.code(403).send({
          error: "Forbidden",
          message: "Admin access required",
        });
      }

      try {
        const [
          userCount,
          projectCount,
          trackCount,
          jobCount,
          subscriptionStats,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.project.count(),
          prisma.track.count(),
          prisma.job.count(),
          prisma.user.groupBy({
            by: ["plan"],
            _count: true,
          }),
        ]);

        return {
          users: userCount,
          projects: projectCount,
          tracks: trackCount,
          jobs: jobCount,
          subscriptions: subscriptionStats.reduce(
            (acc, s) => ({ ...acc, [s.plan]: s._count }),
            {} as Record<string, number>
          ),
        };
      } catch (error) {
        return reply.code(500).send({ error: "Failed to get stats" });
      }
    }
  );
};

export default observabilityRoutes;
