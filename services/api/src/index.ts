import Fastify from "fastify";
import jobsRoutes from "./routes/jobs.js";
import v1Routes from "./routes/v1.js";

const app = Fastify({ logger: true });

// Register application routes
app.register(jobsRoutes);
app.register(v1Routes);

app.get("/health", async () => {
  return {
    ok: true,
    service: "budi-api",
    time: new Date().toISOString(),
  };
});

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});