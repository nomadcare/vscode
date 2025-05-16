// src/theme.ts
import { DefaultTheme } from "styled-components";

export const theme: DefaultTheme = {
	colors: {
		bg: "#0F0F0F",
		bgAlt: "#1A1A1A",
		fg: "#EDEDED",
		accent: "#0A84FF",
		border: "#333333",
		userMsg: "#0A84FF",
	},
	sizes: {
		sidebarWidth: "60px",
		headerHeight: "64px",
		inputHeight: "84px",
	},
	fonts: {
		family: `'Segoe UI','Roboto',sans-serif`,
		base: "15px",
	},
};
