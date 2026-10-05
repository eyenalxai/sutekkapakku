import { defineRailway, github, image, preserve, project, service, volume } from "railway/iac"

export default defineRailway(() => {
  const postgresData = volume("Postgres data", {
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    allowOnlineResize: true,
    region: "us-west2",
    sizeMB: 5000,
  })

  const postgres = service("Postgres", {
    source: image("ghcr.io/railwayapp-templates/timescale-postgis-ssl:pg15-ts2.12"),
    build: { builder: "NIXPACKS" },
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } },
    volumeMounts: { "/var/lib/postgresql/data": postgresData },
    env: {
      DATABASE_PRIVATE_URL: preserve(),
      DATABASE_URL: preserve(),
      NO_TS_TUNE: preserve(),
      PGDATA: preserve(),
      PGDATABASE: preserve(),
      PGHOST: preserve(),
      PGPASSWORD: preserve(),
      PGPORT: preserve(),
      PGUSER: preserve(),
      POSTGRES_DB: preserve(),
      POSTGRES_PASSWORD: preserve(),
      POSTGRES_USER: preserve(),
      RAILWAY_RUN_UID: preserve(),
      SSL_CERT_DAYS: preserve(),
    },
  })

  const app = service("sutekkapakku", {
    source: github("eyenalxai/sutekkapakku", { checkSuites: false }),
    build: { builder: "RAILPACK" },
    start: "bun --bun run src/index.ts",
    healthcheck: "/health",
    replicas: { "us-west2": 1 },
    env: {
      ADMIN_USERNAME: preserve(),
      API_TOKEN: preserve(),
      DATABASE_URL: preserve(),
      DOMAIN: preserve(),
      PGDATABASE: preserve(),
      PGHOST: preserve(),
      PGPASSWORD: preserve(),
      PGPORT: preserve(),
      PGUSER: preserve(),
      POLL_TYPE: preserve(),
    },
  })

  return project("Sutekkapakku", {
    resources: [postgres, app, postgresData],
  })
})
