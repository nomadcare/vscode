import "styled-components";

declare module "styled-components" {
	export interface DefaultTheme {
		colors: {
			bg: string;
			bgAlt: string;
			fg: string;
			accent: string;
			border: string;
			userMsg: string;
		};
		sizes: {
			sidebarWidth: string;
			headerHeight: string;
			inputHeight: string;
		};
		fonts: {
			family: string;
			base: string;
		};
	}
}
