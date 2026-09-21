import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/layouts/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    /* ⚠️ 这里的展开顺序很重要：
       早先写成 `...pluginJs.configs.recommended` 在 `rules` **之前**，
       而 configs 里自带 `rules`，于是后面的 `rules: {...}` 把
       `no-undef` 等基础规则整块覆盖掉了 —— 结果「用了未定义的变量」
       这类错误（例如结果页引用父组件才有的 appliedBook）永远不会被
       lint 报出来，只能在浏览器里炸。基础规则放到 rules 之后展开。 */
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },

  /* =======================================================
     React Three Fiber 场景文件
     -------------------------------------------------------
     R3F 的 JSX 内建元素（<mesh>/<meshStandardMaterial>/<pointLight>…）
     用的是 three.js 的属性名，eslint-plugin-react 的静态白名单里没有，
     会全部报 no-unknown-property。官方做法就是在这类文件里关掉这条规则。
  ======================================================= */
  {
    files: [
      "src/components/world/**/*.{js,jsx}",
      "src/lib/worldData.js",
    ],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
];
