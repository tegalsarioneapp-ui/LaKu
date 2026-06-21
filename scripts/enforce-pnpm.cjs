const ua = process.env.npm_config_user_agent || "";

if (!ua.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm/yarn.");
  process.exit(1);
}

console.log("pnpm detected.");
