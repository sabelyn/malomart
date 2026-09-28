import { writeFileSync } from "fs";

import { buildSpec } from "../src/swagger";

const out = process.argv[2] ?? "openapi.json";
writeFileSync(out, `${JSON.stringify(buildSpec(process.env.API_BASE_URL), null, 2)}\n`);
console.log(`Wrote ${out}`);
