import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const expressApp = express();

let bootstrapError: any = null;

async function bootstrap() {
  try {
    console.log('Bootstrapping NestJS application on Vercel...');
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    // CORS
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    // 🔥 Swagger ONLY in development
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Talash API')
        .setDescription('The Talash App API documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api', app, document);
    }

    await app.init();
    console.log('NestJS application successfully bootstrapped!');
  } catch (error: any) {
    bootstrapError = error;
    console.error('CRITICAL ERROR: Failed to bootstrap NestJS application:', error);
    throw error;
  }
}

// Warm boot caching with local error capturing
const appPromise = bootstrap().catch((err) => {
  bootstrapError = err;
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Wait for bootstrapping to complete
  await appPromise;

  if (bootstrapError) {
    console.error('Vercel handler invoked, but bootstrap previously failed:', bootstrapError);
    return res.status(500).json({
      statusCode: 500,
      message: 'NestJS Application Bootstrap Failed',
      error: bootstrapError?.message || String(bootstrapError),
      stack: bootstrapError?.stack,
      hint: 'Verify all required environment variables are set in the Vercel Dashboard (e.g., MONGO_URI, JWT_ACCESS_SECRET, etc.) and that your database permits connections from anywhere (0.0.0.0/0).',
    });
  }

  expressApp(req as any, res as any);
}