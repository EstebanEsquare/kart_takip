import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile } from "node:fs/promises";
const svg = await readFile("design/icon.svg", "utf8");
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  for (const name of ["ic_launcher", "ic_launcher_round"])
    await writeFile(
      `android/app/src/main/res/mipmap-${density}/${name}.png`,
      png,
    );
}
await writeFile("icon-512.png", new Resvg(svg).render().asPng());
console.log(
  "SVG simgeden PNG yoğunlukları üretildi. Android adaptive/monochrome vektörleri ayrı kaynaklardır.",
);
