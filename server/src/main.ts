import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable Production CORS (Restricted to specific origins in prod)
  app.enableCors({
    origin: '*', // For now we keep it open, but ready for domain restriction
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable Validation Pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip out non-whitelisted properties
      transform: true, // auto-transform payloads to DTO instances
      forbidNonWhitelisted: false, // throw an error if non-whitelisted property is present
    }),
  );

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Talash API')
    .setDescription('The Talash App API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
