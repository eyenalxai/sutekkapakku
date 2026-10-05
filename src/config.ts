import { Config, Context, Effect, Layer, Redacted } from "effect"

import { InvalidConfiguration } from "@/errors"

const MAIN_BOT_PATH = "/webhook/main"

const AppConfig = Config.all({
  apiToken: Config.Redacted("API_TOKEN"),
  adminUsername: Config.NonEmptyString("ADMIN_USERNAME"),
  databaseUrl: Config.String("DATABASE_URL"),
  domain: Config.NonEmptyString("DOMAIN"),
  port: Config.Port("PORT"),
  pollType: Config.Literals(["WEBHOOK", "POLLING"], "POLL_TYPE"),
})

type AppConfigShape = Config.Success<typeof AppConfig> & { readonly mainBotPath: string }

class AppConfiguration extends Context.Service<AppConfiguration, AppConfigShape>()(
  "sutekkapakku/AppConfiguration",
) {
  static readonly layer = Layer.effect(
    AppConfiguration,
    Effect.gen(function* makeAppConfiguration() {
      const config = yield* AppConfig
      if (config.domain.includes("://") || config.domain.startsWith("http")) {
        return yield* Effect.fail(
          new InvalidConfiguration({
            description: `DOMAIN must not include a scheme, got "${config.domain}"`,
          }),
        )
      }
      if (config.domain.endsWith("/")) {
        return yield* Effect.fail(
          new InvalidConfiguration({
            description: `DOMAIN must not end with a slash, got "${config.domain}"`,
          }),
        )
      }
      return AppConfiguration.of({ ...config, mainBotPath: MAIN_BOT_PATH })
    }),
  )
}

const tokenValue = (config: AppConfigShape): string => Redacted.value(config.apiToken)

export { AppConfiguration, MAIN_BOT_PATH, tokenValue }
export type { AppConfigShape }
