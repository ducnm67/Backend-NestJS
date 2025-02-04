import { Injectable } from '@nestjs/common';
import {
  MulterModuleOptions,
  MulterOptionsFactory,
} from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import { diskStorage } from 'multer';
import path from 'path';

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
  private getRootPath(): string {
    return process.cwd();
  }

  private async ensureExists(targetDirectory: string): Promise<void> {
    try {
      await fs.mkdir(targetDirectory, { recursive: true });
    } catch (error) {
      console.error(
        `Error creating directory ${targetDirectory}:`,
        error.message,
      );
    }
  }

  createMulterOptions(): MulterModuleOptions {
    return {
      storage: diskStorage({
        destination: async (req, file, cb) => {
          const folder = (req?.headers?.folder_type as string) || 'default';
          const safeFolder = folder.replace(/[^a-zA-Z0-9-_]/g, ''); // Loại bỏ ký tự đặc biệt
          const uploadPath = path.resolve(
            this.getRootPath(),
            'public/images',
            safeFolder,
          );

          await this.ensureExists(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const extName = path.extname(file.originalname);
          const baseName = path
            .basename(file.originalname, extName)
            .replace(/[^a-zA-Z0-9-_]/g, ''); // Xử lý tên file an toàn
          const finalName = `${baseName}-${Date.now()}${extName}`;
          cb(null, finalName);
        },
      }),
    };
  }
}
