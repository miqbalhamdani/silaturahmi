import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Silaturahmi",
  description: "A living map of the family — explore generations on an interactive canvas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <script
          // set .dark before paint to avoid theme flash
          dangerouslySetInnerHTML={{
            __html: `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
