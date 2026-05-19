import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: Express.Multer.File,
    folder: string = 'avatars',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          if (result) return resolve(result);
          reject(new Error('Unknown upload error'));
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  uploadAudioBuffer(
    buffer: Buffer,
    folder: string = 'voice_chats',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'video', // Cloudinary uses 'video' for audio files
        },
        (error, result) => {
          if (error) return reject(error);
          if (result) return resolve(result);
          reject(new Error('Unknown upload error'));
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  uploadPdfBuffer(
    buffer: Buffer,
    filename: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    console.log(`[PDF_UPLOAD_START] Starting PDF upload to Cloudinary. Filename: ${filename}`);
    console.log(`[PDF_RESOURCE_TYPE] resource_type: raw`);
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'legal_docs',
          resource_type: 'raw',
          public_id: filename,
        },
        (error, result) => {
          if (error) {
            console.error(`[PDF_UPLOAD_FAILED] PDF upload failed: ${error.message}`);
            return reject(error);
          }
          if (result) {
            console.log(`[PDF_UPLOAD_SUCCESS] PDF uploaded successfully.`);
            console.log(`[PDF_URL] secure_url: ${result.secure_url}`);
            return resolve(result);
          }
          const unknownError = new Error('Unknown upload error');
          console.error(`[PDF_UPLOAD_FAILED] PDF upload failed: ${unknownError.message}`);
          reject(unknownError);
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }
}

