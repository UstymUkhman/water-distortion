import { resolve } from 'path';
import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';
import { version } from './package.json';

export default ({ mode }: { mode: string }) =>
  defineConfig({
    base: './',

    build: { target: 'esnext' },

    css: {
      modules: {
        localsConvention: 'camelCaseOnly'
      }
    },

    define: {
      DEBUG: mode !== 'production' && false,
      VERSION: JSON.stringify(version)
    },

    plugins: [glsl({ compress: mode === 'production' })],

    resolve: {
      alias: { '@': resolve('src') },
      conditions: ['development', 'browser']
    },

    server: {
      host: '0.0.0.0',
      port: 8080,
      open: true
    }
  });
