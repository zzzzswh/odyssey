// Allow importing .css files as text strings via esbuild's text loader.
declare module "*.css" {
  const content: string;
  export default content;
}
