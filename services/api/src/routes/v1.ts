import { FastifyPluginAsync } from "fastify";
import Redis from "ioredis";
import {
  AnalyzeJob,
  FixJob,
  MasterJob,
  CodecPreviewJob,
  Job,
} from "@budi/contracts";

// A simple ID generator using timestamp and random number
function generateId(prefix = ""): string {
  return (
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

const redis = new Redis(
  Number(process.env.REDIS_PORT ?? 6379),
  process.env.REDIS_HOST ?? "localhost"
);

// Helper to enqueue jobs onto Redis list
async function enqueue(job: Job) {
  await redis.lpush("jobs", JSON.stringify(job));
}

const v1Routes: FastifyPluginAsync = async (app) => {
  /** Create a new project */
  app.post<{ Body: { type?: string } }>("/v1/projects", async (request, reply) => {
    const id = generateId("proj_");
    const type = request.body?.type ?? "single";
    // In a real implementation you would persist this project to a database
    reply.code(201).send({ id, type });
  });

  /** Import a track into a project */
  app.post<{ Params: { projectId: string }; Body: { sourceUrl: string; trackId?: string } }>(
    "/v1/projects/:projectId/tracks/import",
    async (request, reply) => {
      const trackId = request.body.trackId ?? generateId("trk_");
      const { projectId } = request.params;
      const { sourceUrl } = request.body;
      // In a real implementation you would persist the track metadata
      reply.code(201).send({ projectId, trackId, sourceUrl });
    }
  );

  /** Enqueue an analyze job for a track */
  app.post<{ Params: { trackId: string }; Body: AnalyzeJob }>(
    "/v1/tracks/:trackId/analyze",
    async (request, reply) => {
      const { trackId } = request.params;
      const { sourceUrl } = request.body;
      await enqueue({ type: "analyze", trackId, sourceUrl });
      reply.code(202).send({ enqueued: true });
    }
  );

  /** Enqueue a fix job for a track */
  app.post<{ Params: { trackId: string }; Body: FixJob }>(
    "/v1/tracks/:trackId/fix",
    async (request, reply) => {
      const { trackId } = request.params;
      const { sourceUrl, modules } = request.body;
      await enqueue({ type: "fix", trackId, sourceUrl, modules });
      reply.code(202).send({ enqueued: true });
    }
  );

  /** Enqueue a master job for a track */
  app.post<{ Params: { trackId: string }; Body: MasterJob }>(
    "/v1/tracks/:trackId/master",
    async (request, reply) => {
      const { trackId } = request.params;
      const { sourceUrl, profile } = request.body;
      await enqueue({ type: "master", trackId, sourceUrl, profile });
      reply.code(202).send({ enqueued: true });
    }
  );

  /** Enqueue a codec preview job for a track */
  app.post<{ Params: { trackId: string }; Body: CodecPreviewJob }>(
    "/v1/tracks/:trackId/codec-preview",
    async (request, reply) => {
      const { trackId } = request.params;
      const { masterUrl, codecs } = request.body;
      await enqueue({ type: "codec-preview", trackId, masterUrl, codecs });
      reply.code(202).send({ enqueued: true });
    }
  );

  /** Enqueue an album master job for a project */
  app.post<{ Params: { projectId: string }; Body: { trackIds: string[]; profile: string } }>(
    "/v1/projects/:projectId/album-master",
    async (request, reply) => {
      const { projectId } = request.params;
      const { trackIds, profile } = request.body;
      // For album mastering we enqueue a master job for each track with album flag
      for (const trackId of trackIds) {
        await enqueue({ type: "master", trackId, sourceUrl: "", profile });
      }
      reply.code(202).send({ enqueued: true, projectId, trackIds, profile });
    }
  );

  /** Export a project */
  app.post<{ Params: { projectId: string } }>(
    "/v1/projects/:projectId/export",
    async (request, reply) => {
      const { projectId } = request.params;
      // In real implementation generate export zip and return URL
      reply.code(202).send({ enqueued: true, projectId });
    }
  );

  /** Dummy job status endpoint */
  app.get<{ Params: { jobId: string } }>("/v1/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    // In a real implementation fetch job status from database or queue
    reply.send({ jobId, status: "pending" });
  });

  /** Dummy report endpoint */
  app.get<{ Params: { trackId: string } }>("/v1/tracks/:trackId/reports", async (request, reply) => {
    const { trackId } = request.params;
    // In a real implementation return analysis/mastering reports
    reply.send({ trackId, reports: [] });
  });
};

export default v1Routes;