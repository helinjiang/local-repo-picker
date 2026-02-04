export type AppPaths = {
  configDir: string
  dataDir: string
}

export function getPaths(): AppPaths {
  const home =
    process.env.HOME || process.env.USERPROFILE || process.cwd()

  return {
    configDir: `${home}/.config/local-repo-picker`,
    dataDir: `${home}/.local/share/local-repo-picker`
  }
}
