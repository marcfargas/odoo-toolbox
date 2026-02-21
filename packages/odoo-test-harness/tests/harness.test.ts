import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionPartnerCategories, provisionPartners } from '../src/provisioners/partners';
import { provisionTaskProperties } from '../src/provisioners/properties';
import { provisionUsers } from '../src/provisioners/users';
import type { ProvisionerClient } from '../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockClient(overrides: Partial<ProvisionerClient> = {}): ProvisionerClient {
  let nextId = 100;
  return {
    create: vi.fn(async () => nextId++),
    search: vi.fn(async () => [] as number[]),
    searchRead: vi.fn(async () => [] as any[]),
    write: vi.fn(async () => true),
    modules: {
      isModuleInstalled: vi.fn(async () => false),
      installModule: vi.fn(async () => {}),
    },
    ...overrides,
  } as ProvisionerClient;
}

// ─── Partner categories ────────────────────────────────────────────────────────

describe('provisionPartnerCategories', () => {
  let client: ProvisionerClient;

  beforeEach(() => {
    client = makeMockClient();
  });

  it('returns empty object when no categories requested', async () => {
    const refs = await provisionPartnerCategories(client, []);
    expect(refs).toEqual({});
    expect(client.create).not.toHaveBeenCalled();
  });

  it('creates each category and maps name → id', async () => {
    const refs = await provisionPartnerCategories(client, ['Customer', 'Vendor']);
    expect(Object.keys(refs)).toEqual(['Customer', 'Vendor']);
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(client.create).toHaveBeenCalledWith('res.partner.category', { name: 'Customer' });
    expect(client.create).toHaveBeenCalledWith('res.partner.category', { name: 'Vendor' });
  });

  it('reuses existing category (idempotent: search before create)', async () => {
    // Simulate existing category
    (client.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce([42]);

    const refs = await provisionPartnerCategories(client, ['Customer']);
    expect(refs['Customer']).toBe(42);
    expect(client.create).not.toHaveBeenCalled();
  });
});

// ─── Partners ─────────────────────────────────────────────────────────────────

describe('provisionPartners', () => {
  let client: ProvisionerClient;

  beforeEach(() => {
    client = makeMockClient();
  });

  it('returns empty object when no partners requested', async () => {
    const refs = await provisionPartners(client, [], {});
    expect(refs).toEqual({});
  });

  it('creates a company with is_company=true', async () => {
    await provisionPartners(client, [{ name: 'Acme Corp', isCompany: true }], {});
    expect(client.create).toHaveBeenCalledWith(
      'res.partner',
      expect.objectContaining({ name: 'Acme Corp', is_company: true })
    );
  });

  it('links category via many2many command when category is provided', async () => {
    const catRefs = { Customer: 7 };
    await provisionPartners(client, [{ name: 'Partner A', category: 'Customer' }], catRefs);
    expect(client.create).toHaveBeenCalledWith(
      'res.partner',
      expect.objectContaining({ category_id: [[4, 7]] })
    );
  });

  it('throws when category ref is missing', async () => {
    await expect(
      provisionPartners(client, [{ name: 'X', category: 'Unknown' }], {})
    ).rejects.toThrow(/unknown category "Unknown"/i);
  });

  it('resolves parentName to a previously created partner ID', async () => {
    // First call creates company at id 100, second creates contact
    await provisionPartners(
      client,
      [
        { name: 'Parent Corp', isCompany: true },
        { name: 'Child Contact', parentName: 'Parent Corp' },
      ],
      {}
    );

    const secondCall = (client.create as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondCall[1].parent_id).toBe(100);
  });

  it('throws when parentName is not found in provisioned refs', async () => {
    await expect(
      provisionPartners(client, [{ name: 'Orphan', parentName: 'Ghost Corp' }], {})
    ).rejects.toThrow(/unknown parent "Ghost Corp"/i);
  });
});

// ─── Task properties ──────────────────────────────────────────────────────────

describe('provisionTaskProperties', () => {
  let client: ProvisionerClient;

  beforeEach(() => {
    client = makeMockClient();
  });

  it('does nothing when no properties are given', async () => {
    await provisionTaskProperties(client, [1, 2], []);
    expect(client.write).not.toHaveBeenCalled();
  });

  it('does nothing when no project IDs are given', async () => {
    await provisionTaskProperties(client, [], [{ name: 'P', type: 'char' }]);
    expect(client.write).not.toHaveBeenCalled();
  });

  it('writes task_properties_definition to each project', async () => {
    await provisionTaskProperties(client, [10, 20], [{ name: 'Notes', type: 'char' }]);
    expect(client.write).toHaveBeenCalledTimes(2);
    expect(client.write).toHaveBeenCalledWith(
      'project.project',
      10,
      expect.objectContaining({ task_properties_definition: expect.any(Array) })
    );
  });

  it('builds selection options as [[value, label], ...] pairs', async () => {
    await provisionTaskProperties(
      client,
      [5],
      [{ name: 'Priority', type: 'selection', options: ['Low', 'High'] }]
    );
    const call = (client.write as ReturnType<typeof vi.fn>).mock.calls[0];
    const defs = call[2].task_properties_definition;
    expect(defs[0].type).toBe('selection');
    expect(defs[0].selection).toEqual([
      ['low', 'Low'],
      ['high', 'High'],
    ]);
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe('provisionUsers', () => {
  let client: ProvisionerClient;

  beforeEach(() => {
    client = makeMockClient();
  });

  it('returns empty object when no users requested', async () => {
    const refs = await provisionUsers(client, []);
    expect(refs).toEqual({});
  });

  it('creates a user with name and login', async () => {
    await provisionUsers(client, [{ name: 'Test Manager', login: 'mgr@test.com' }]);
    expect(client.create).toHaveBeenCalledWith(
      'res.users',
      expect.objectContaining({ name: 'Test Manager', login: 'mgr@test.com' })
    );
  });

  it('resolves group XML IDs and attaches them via many2many command', async () => {
    (client.searchRead as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ res_id: 55 }]);

    await provisionUsers(client, [
      { name: 'PM', login: 'pm@test.com', groups: ['project.group_project_manager'] },
    ]);

    const createCall = (client.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(createCall[1].groups_id).toEqual([[4, 55]]);
  });

  it('throws when a group XML ID cannot be resolved', async () => {
    // searchRead returns empty → group not found
    (client.searchRead as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await expect(
      provisionUsers(client, [
        { name: 'User', login: 'u@test.com', groups: ['fake.group_does_not_exist'] },
      ])
    ).rejects.toThrow(/not found/i);
  });

  it('throws on malformed group XML ID (missing dot)', async () => {
    await expect(
      provisionUsers(client, [{ name: 'User', login: 'u@test.com', groups: ['nodotgroupid'] }])
    ).rejects.toThrow(/invalid group xml id/i);
  });
});
