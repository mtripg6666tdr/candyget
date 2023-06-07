// @ts-check
const path = require("path");

/** @type {import("eslint-define-config").ESLintConfig} */
module.exports = {
  "root": true,
  "env": {
    "node": true,
    "commonjs": true,
    "es2019": true,
  },
  "extends": [
    "eslint:recommended",
    "plugin:eslint-comments/recommended"
  ],
  "plugins": [
    "eslint-comments",
    "node"
  ],
  "rules": {
    "semi": "off",
    "import/order": ["warn", {
      "groups": [
        "type", 
        "builtin", 
        "external", 
        [
          "parent", 
          "sibling", 
          "index"
        ],
        "object"
      ],
      "pathGroups": [],
      "pathGroupsExcludedImportTypes": ["builtin", "type"],
      "alphabetize": {
        "order": "asc"
      },
      "newlines-between": "always"
    }],
    "eslint-comments/no-unused-disable": "error"
  },
  "overrides": [
    {
      "files": "**/*.ts",
      "extends": [
        "plugin:@typescript-eslint/recommended"
      ],
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
        "project": "./tsconfig.json"
      },
      "plugins": [
        "@typescript-eslint",
        "named-import-spacing",
        "import"
      ],
      "rules": {
        "@typescript-eslint/semi": ["error", "always"],
        "@typescript-eslint/no-unnecessary-type-assertion": "warn",
        "@typescript-eslint/no-non-null-assertion": "off",
        "named-import-spacing/named-import-spacing": "warn",
        "@typescript-eslint/no-explicit-any": "off"
      }
    },
    {
      "files": "./packages/candyget/src/**/*.ts",
      "parserOptions": {
        "project": path.join(__dirname, "./packages/candyget/tsconfig.json"),
      }
    },
    {
      "files": "./packages/browser/src/**/*.ts",
      "parserOptions": {
        "project": path.join(__dirname, "./packages/browser/tsconfig.json"),
      }
    }
  ]
}
