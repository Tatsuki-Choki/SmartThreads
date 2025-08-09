import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
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

    // 開発環境でのバイパス機能
    if (this.configService.get("NODE_ENV") === "development") {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;

      if (authHeader === "Bearer dev-token-bypass") {
        // 開発用の疑似ユーザーを設定（UUID形式）
        request.user = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "dev@smartthreads.local",
          role: "admin",
        };
        return true;
      }
    }

    return super.canActivate(context);
  }
}
