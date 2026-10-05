import { ConfigProvider, Layer, ManagedRuntime } from "effect"

import { TelegramApi } from "@/bot/telegram-api"
import { Users } from "@/bot/users"
import { AppConfiguration } from "@/config"
import { Database } from "@/db/database"
import { effectLoggerLayer } from "@/logger"

const ConfigProviderLayer = ConfigProvider.layer(ConfigProvider.fromEnv())

const AppLayer = Layer.mergeAll(
  Database.layer,
  TelegramApi.layer,
  Users.layer,
  effectLoggerLayer,
).pipe(Layer.provideMerge(AppConfiguration.layer), Layer.provide(ConfigProviderLayer))

type AppServices = Layer.Success<typeof AppLayer>

const runtime = ManagedRuntime.make(AppLayer)

export { AppLayer, runtime }
export type { AppServices }
