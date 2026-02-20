import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService) {
    const domain = config.get<string>('AUTH0_DOMAIN');
    const audience = config.get<string>('AUTH0_AUDIENCE');

    if (!domain) {
      JwtStrategy.logger.warn(
        'AUTH0_DOMAIN is not set — JWT auth will reject all requests. Set it in .env to enable authentication.',
      );
      // Provide a dummy config so NestJS boots without crashing.
      // All tokens will fail validation (secret always returns null).
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'no-auth0-domain-configured',
        algorithms: ['HS256'],
      });
      return;
    }

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer: `https://${domain}/`,
      algorithms: ['RS256'],
    });
  }

  validate(payload: any) {
    return {
      sub: payload.sub,
      email: payload.email,
      permissions: payload.permissions || [],
    };
  }
}
