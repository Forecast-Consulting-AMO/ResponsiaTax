/** @type {import('orval').Options} */
const config = {
  api: {
    input: {
      target: process.env.OPENAPI_URL || 'http://localhost:3000/api/docs-json',
    },
    output: {
      target: 'apps/responsia-tax-frontend/src/api/api.ts',
      client: 'react-query',
      mode: 'single',
      override: {
        mutator: {
          path: 'apps/responsia-tax-frontend/src/api/mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
};

export default config;
