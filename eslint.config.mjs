// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  rules: {
    // Void elements may be written <br> or <br />: editors running Prettier add the slash.
    // Everything else keeps Vue's defaults
    "vue/html-self-closing": [
      "warn",
      { html: { void: "any", normal: "always", component: "always" }, svg: "always", math: "always" },
    ],
  },
});
