# TODO - Ready to Implement

Tasks that are designed and ready for implementation. Organized by priority.

---

**Current packages:**
- `packages/odoo-client` - Lightweight RPC client for runtime
- `packages/odoo-introspection` - Schema introspection and TypeScript codegen
- `packages/odoo-state-manager` - State management (compare, plan, apply)

---

## Future Enhancements (P5+)

### Client Enhancements
- [ ] Add retry logic for transient failures (exponential backoff)
- [ ] Add connection timeout configuration
- [ ] Add request logging (with `debug` library)
- [ ] Add validation for connection params
- [ ] Connection pooling (investigate need)

### State Manager Enhancements
- [ ] Operation batching optimization
- [ ] Group similar operations (create all then update all)
- [ ] Profile query performance gains

### Type System Improvements
- [ ] Type-safe domain selectors (see ROADMAP.md)
- [ ] Selection field union types
- [ ] Date/DateTime handling utilities

See [ROADMAP.md](./ROADMAP.md) for long-term design decisions and research items.
