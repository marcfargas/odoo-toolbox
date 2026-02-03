/**
 * Services - High-level business logic for Odoo operations
 *
 * Service classes provide reusable business logic that can be used
 * by MCP servers, CLIs, scripts, or any other consumer of @odoo-toolbox/client.
 *
 * Each service focuses on a specific domain:
 * - MailService: Message posting, internal notes, message history
 * - ActivityService: Activity scheduling, completion, cancellation
 * - FollowerService: Follower management (list, add, remove)
 * - PropertiesService: Properties field operations with safe updates
 */

export * from './mail-service';
export * from './activity-service';
export * from './follower-service';
export * from './properties-service';
