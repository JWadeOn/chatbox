import { describe, expect, it } from 'vitest';
import { ensurePgSslQueryString, poolSslFromUrl } from '../../server/lib/pg-ssl-url';

describe('pg-ssl-url', () => {
  it('poolSslFromUrl is undefined for localhost', () => {
    expect(poolSslFromUrl('postgresql://localhost:5432/chatbridge')).toBeUndefined();
  });

  it('poolSslFromUrl enables TLS for Render host', () => {
    expect(poolSslFromUrl('postgresql://u:p@x.virginia-postgres.render.com/db')).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('poolSslFromUrl relaxes CA check for Railway proxy host', () => {
    expect(poolSslFromUrl('postgresql://u:p@interchange.proxy.rlwy.net:59443/railway')).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('ensurePgSslQueryString appends sslmode for rlwy when missing', () => {
    const base = 'postgresql://u:p@host.proxy.rlwy.net:123/db';
    expect(ensurePgSslQueryString(base)).toBe(`${base}?sslmode=require`);
  });

  it('ensurePgSslQueryString leaves localhost unchanged', () => {
    const u = 'postgresql://localhost:5432/chatbridge';
    expect(ensurePgSslQueryString(u)).toBe(u);
  });
});
