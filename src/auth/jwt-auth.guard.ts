import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY, IS_PUBLIC_PERMISSION } from 'src/decorator/customize';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();
    const isSkipCheckPermission = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_PERMISSION,
      [context.getHandler(), context.getClass()],
    );

    // Kiểm tra nếu không có người dùng hoặc có lỗi
    if (err || !user) {
      throw err || new UnauthorizedException('Token không hợp lệ');
    }

    const targetMethod = request.method;
    const targetEndpoint = request.route?.path as string;

    // Log để debug
    console.log('Phương thức mục tiêu:', targetMethod);
    console.log('Đường dẫn mục tiêu:', targetEndpoint);
    console.log('Quyền của người dùng:', user.permissions);

    const permissions = user.permissions ?? [];
    let hasPermission = permissions.some(
      (permission) =>
        targetMethod === permission.method &&
        targetEndpoint === permission.apiPath,
    );

    // Cho phép tất cả các endpoint "/api/v1/auth"
    if (targetEndpoint.startsWith('/api/v1/auth')) {
      hasPermission = true;
    }

    // Nếu kiểm tra quyền bị bỏ qua, cho phép truy cập
    if (!hasPermission && !isSkipCheckPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền để truy cập endpoint này!',
      );
    }

    return user;
  }
}
