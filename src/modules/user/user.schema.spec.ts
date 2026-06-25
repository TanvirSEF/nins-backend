import { model } from 'mongoose';
import { UserSchema } from './user.schema';

/**
 * Security regression test: the password hash must NEVER appear in a serialized
 * user, even when it was explicitly selected (login/register). Runs in-memory —
 * no MongoDB connection required. See `UserSchema.set('toJSON', ...)` and PRD
 * §5.3 (response envelope).
 */
describe('UserSchema.toJSON (password-hash leak guard)', () => {
  // Unique model name so this never collides with the real 'User' model or
  // other test specs in the suite.
  const User = model('UserSchemaTest', UserSchema);

  it('omits passwordHash from a document that has it populated', () => {
    const doc = new User({
      email: 'leak-test@nins.gov.bd',
      passwordHash: '$2b$10$SUPERSECRET',
      name: 'Leak Test',
      role: 'PATIENT',
      phone: '01700000000',
    });

    const json = doc.toJSON();

    expect(json.passwordHash).toBeUndefined();
    expect(json.email).toBe('leak-test@nins.gov.bd');
    expect(json.name).toBe('Leak Test');
    expect(json.role).toBe('PATIENT');
    expect(json.phone).toBe('01700000000');
  });

  it('still exposes passwordHash in-memory (only the JSON output is stripped)', () => {
    const doc = new User({
      email: 'x@nins.gov.bd',
      passwordHash: '$2b$10$SUPERSECRET',
      name: 'X',
      role: 'PATIENT',
    });
    // The service still needs the hash to verify the credential.
    expect(doc.passwordHash).toBe('$2b$10$SUPERSECRET');
    expect(doc.toJSON().passwordHash).toBeUndefined();
  });
});
