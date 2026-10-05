interface CommandOptions {
  cwd?: string
  env?: Record<string, string>
}

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

const runCommand = async (
  command: string[],
  options: CommandOptions = {},
): Promise<CommandResult> => {
  const subprocess = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: { ...Bun.env, ...options.env } }),
  })
  const [stdout, stderr] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ])
  const exitCode = await subprocess.exited
  return { exitCode, stderr, stdout }
}

export { runCommand }
export type { CommandOptions, CommandResult }
