import { Button, createTheme } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";

const dark: MantineColorsTuple = [
  "#ece2cc",
  "#cfc5b1",
  "#a99f8c",
  "#837a6c",
  "#5a5260",
  "#3b3543",
  "#2a2531",
  "#1d1a24",
  "#16131c",
  "#0f0d13"
];

const velvet: MantineColorsTuple = [
  "#f6e4e8",
  "#e6bcc6",
  "#d493a3",
  "#c16a80",
  "#a84a63",
  "#8c3750",
  "#6f2a3f",
  "#5a2233",
  "#4a1e2b",
  "#331420"
];

const gilt: MantineColorsTuple = [
  "#f7f0dc",
  "#ece0b8",
  "#dfcc8f",
  "#d0b769",
  "#c4a64f",
  "#b8963e",
  "#9a7c32",
  "#7b6228",
  "#5d4a1f",
  "#3f3215"
];

const discount: MantineColorsTuple = [
  "#ffe6f0",
  "#ffc2da",
  "#ff9cc2",
  "#ff76aa",
  "#ff5f9b",
  "#ff4f8b",
  "#e63d78",
  "#c22e63",
  "#9c224f",
  "#73173a"
];

const twili: MantineColorsTuple = [
  "#e0faf7",
  "#b8f1eb",
  "#8fe7de",
  "#74ddd2",
  "#5fd4c8",
  "#45c2b5",
  "#33a296",
  "#268278",
  "#1b625a",
  "#11423d"
];

export default createTheme({
  colors: { dark, velvet, gilt, discount, twili },
  primaryColor: "discount",
  primaryShade: 5,
  black: "#16131c",
  white: "#ece2cc",
  autoContrast: true,
  luminanceThreshold: 0.25,
  fontFamily: "'Inter Variable', system-ui, sans-serif",
  headings: {
    fontFamily: "'IM Fell English', Georgia, serif",
    fontWeight: "400",
    sizes: {
      h1: { fontSize: "3rem", lineHeight: "1.1" },
      h2: { fontSize: "2.25rem", lineHeight: "1.15" },
      h3: { fontSize: "1.5rem", lineHeight: "1.25" }
    }
  },
  defaultRadius: "xs",
  other: {
    signFontFamily: "'Shrikhand', 'Arial Black', sans-serif"
  },
  components: {
    Button: Button.extend({
      defaultProps: { radius: "xl" }
    })
  }
});
