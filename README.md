# Budi

This repository contains the monorepo setup for the **Budi** application. It includes:

- `apps/` — placeholders for the native mobile applications.
- `services/` — backend API and worker services.
- `packages/` — shared libraries and configurations.
- `infra/` — Docker Compose configuration for local development (Postgres, Redis, MinIO).

To get started:

```sh
pnpm install
pnpm infra:up
pnpm dev
```

Then visit `http://localhost:4000/health` to check that the API is running.

### Next steps and API overview

This monorepo now includes a **Budi** job queue and contracts for audio processing:

- `packages/contracts` defines TypeScript interfaces for jobs (analyze, fix, master and codec preview).
- `services/api` exposes HTTP endpoints to create projects, import tracks and queue analysis/mastering jobs.
- `services/worker-dsp` and `services/worker-codec` are Rust crates that listen for jobs from Redis and will eventually perform audio analysis, mastering and codec preview.

#### API overview

The API exposes a set of versioned endpoints under `/v1` for interacting with Budi:

- `POST /v1/projects` – create a new project (single or album).
- `POST /v1/projects/{projectId}/tracks/import` – import a track (URL) into a project.
- `POST /v1/tracks/{trackId}/analyze` – enqueue an analysis job (LUFS/LRA/true‑peak/clipping).
- `POST /v1/tracks/{trackId}/fix` – enqueue a fix job (clipping repair, de‑ess, noise reduction).
- `POST /v1/tracks/{trackId}/master` – enqueue a master job with a given profile.
- `POST /v1/tracks/{trackId}/codec-preview` – enqueue a codec preview job.
- `POST /v1/projects/{projectId}/album-master` – perform batch mastering for an album.
- `POST /v1/projects/{projectId}/export` – export the final master pack (HD WAV, WAV and MP3) and QC report.
- `GET /v1/jobs/{jobId}` – poll job status.
- `GET /v1/tracks/{trackId}/reports` – retrieve analysis/mastering reports (stub).

To enqueue a job you can `POST` to any of the `/v1/...` endpoints listed above. The DSP and codec workers will pick it up and process it. At this stage the workers simply log the jobs for illustration; you will need to implement the actual audio processing logic.