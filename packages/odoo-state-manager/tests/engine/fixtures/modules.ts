import { resource } from '../../../src/dsl';
export default ['project', 'sale'].map((name) => resource('ir.module.module', { name }));
