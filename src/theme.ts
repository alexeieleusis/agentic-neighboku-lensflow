import { createTheme } from "@mui/material/styles";

// requirements.md §5.1: dark theme is forced regardless of OS/browser preference, for
// both the real app (main.tsx) and the Storybook catalog (.storybook/preview.tsx).
export const darkTheme = createTheme({
  palette: { mode: "dark" },
});
