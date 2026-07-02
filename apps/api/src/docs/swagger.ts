import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env.js';

// Use forward slashes — the `glob` library (used by swagger-jsdoc) treats
// backslashes as escapes, so Windows paths from path.join must be normalized.
const here = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');

const definition: swaggerJsdoc.Options['definition'] = {
  openapi: '3.0.3',
  info: {
    title: 'Orbit API',
    version: '0.1.0',
    description: 'REST API for the Orbit social platform.',
  },
  servers: [{ url: `${env.API_URL}/api/v1`, description: env.NODE_ENV }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      RegisterInput: {
        type: 'object',
        required: ['firstName', 'lastName', 'username', 'email', 'password'],
        properties: {
          firstName: { type: 'string', example: 'Ada' },
          lastName: { type: 'string', example: 'Lovelace' },
          username: { type: 'string', example: 'ada' },
          email: { type: 'string', format: 'email', example: 'ada@example.com' },
          phone: { type: 'string', example: '+1 555 0100' },
          password: { type: 'string', format: 'password', example: 'Sup3rSecret' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: { type: 'string', description: 'email or username', example: 'ada' },
          password: { type: 'string', format: 'password', example: 'Sup3rSecret' },
          rememberMe: { type: 'boolean', example: true },
          twoFactorCode: { type: 'string', example: '123456' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
    },
  },
};

const spec = swaggerJsdoc({
  definition,
  // Scan route files for @openapi annotations (dev: .ts source).
  apis: [
    `${here}/../routes/*.ts`,
    `${here}/../modules/**/*.routes.ts`,
    `${here}/../routes/*.js`,
    `${here}/../modules/**/*.routes.js`,
  ],
});

export function mountSwagger(app: Express): void {
  app.get('/api/docs.json', (_req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Orbit API docs' }));
}
