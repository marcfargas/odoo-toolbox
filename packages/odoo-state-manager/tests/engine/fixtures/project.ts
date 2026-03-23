import { resource, lookup } from '../../../src/dsl';
const marc = lookup('res.users', { email: 'marc@example.com' });
export const censos = resource('project.project', {
  _ref: lookup('project.project', { name: 'Censos' }),
  name: 'Censos',
  user_id: marc,
});
