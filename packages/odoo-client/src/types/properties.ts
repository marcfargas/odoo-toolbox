/**
 * Type definitions for Odoo Properties fields
 * 
 * Properties in Odoo are user-definable fields that can be created dynamically
 * via the web UI. They appear in models like crm.lead (lead_properties) and
 * project.task (task_properties).
 * 
 * Allowed property types (from odoo/fields.py:Properties.ALLOWED_TYPES):
 * - boolean, integer, float, char, date, datetime (standard types)
 * - many2one, many2many, selection, tags (relational-like types)
 * - separator (UI type)
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188 - Properties class
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419 - PropertiesDefinition class
 * @see https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py - lead_properties usage
 */

/**
 * Base property definition interface
 * 
 * Defines the structure of a property in PropertiesDefinition fields.
 * Each property has a name (technical identifier), type, and human-readable string.
 */
export interface PropertyDefinitionBase {
  /** Technical name of the property (e.g., 'custom_field_1') */
  name: string;
  /** Human-readable label (e.g., 'Custom Field 1') */
  string: string;
}

/**
 * Character/Text property definition
 */
export interface CharPropertyDefinition extends PropertyDefinitionBase {
  type: 'char';
}

/**
 * Separator property definition (UI element, no value)
 * 
 * Used to organize properties visually in the UI.
 * Handled in: odoo/fields.py:Properties.ALLOWED_TYPES
 */
export interface SeparatorPropertyDefinition extends PropertyDefinitionBase {
  type: 'separator';
}

/**
 * Integer property definition
 */
export interface IntegerPropertyDefinition extends PropertyDefinitionBase {
  type: 'integer';
}

/**
 * Float property definition
 */
export interface FloatPropertyDefinition extends PropertyDefinitionBase {
  type: 'float';
}

/**
 * Boolean property definition
 */
export interface BooleanPropertyDefinition extends PropertyDefinitionBase {
  type: 'boolean';
}

/**
 * Date property definition
 */
export interface DatePropertyDefinition extends PropertyDefinitionBase {
  type: 'date';
}

/**
 * DateTime property definition
 */
export interface DateTimePropertyDefinition extends PropertyDefinitionBase {
  type: 'datetime';
}

/**
 * Selection property definition
 * 
 * Selection options are defined as an array of [value, label] tuples.
 */
export interface SelectionPropertyDefinition extends PropertyDefinitionBase {
  type: 'selection';
  /** Array of [value, label] tuples */
  selection: Array<[string, string]>;
}

/**
 * Many2one property definition
 * 
 * References a single record in another model.
 */
export interface Many2onePropertyDefinition extends PropertyDefinitionBase {
  type: 'many2one';
  /** Target model name (e.g., 'res.partner') */
  comodel: string;
}

/**
 * Many2many property definition
 * 
 * References multiple records in another model.
 */
export interface Many2manyPropertyDefinition extends PropertyDefinitionBase {
  type: 'many2many';
  /** Target model name (e.g., 'res.partner') */
  comodel: string;
}

/**
 * Tags property definition
 * 
 * Free-form tags input.
 */
export interface TagsPropertyDefinition extends PropertyDefinitionBase {
  type: 'tags';
}

/**
 * Union type of all property definitions
 */
export type PropertyDefinition =
  | CharPropertyDefinition
  | IntegerPropertyDefinition
  | FloatPropertyDefinition
  | BooleanPropertyDefinition
  | DatePropertyDefinition
  | DateTimePropertyDefinition
  | SelectionPropertyDefinition
  | Many2onePropertyDefinition
  | Many2manyPropertyDefinition
  | TagsPropertyDefinition
  | SeparatorPropertyDefinition;

/**
 * Array of property definitions (PropertiesDefinition field type)
 */
export type PropertiesDefinition = PropertyDefinition[];

/**
 * Base property value interface (read format)
 * 
 * When reading properties from Odoo, they come as an array of objects
 * with the full property definition plus the value.
 */
export interface PropertyValueBase extends PropertyDefinitionBase {
  type: string;
}

/**
 * Character/Text property value (read format)
 */
export interface CharPropertyValue extends PropertyValueBase {
  type: 'char';
  value: string;
}

/**
 * Integer property value (read format)
 */
export interface IntegerPropertyValue extends PropertyValueBase {
  type: 'integer';
  value: number;
}

/**
 * Float property value (read format)
 */
export interface FloatPropertyValue extends PropertyValueBase {
  type: 'float';
  value: number;
}

/**
 * Boolean property value (read format)
 */
export interface BooleanPropertyValue extends PropertyValueBase {
  type: 'boolean';
  value: boolean;
}

/**
 * Date property value (read format)
 */
export interface DatePropertyValue extends PropertyValueBase {
  type: 'date';
  value: string; // ISO date string
}

/**
 * DateTime property value (read format)
 */
export interface DateTimePropertyValue extends PropertyValueBase {
  type: 'datetime';
  value: string; // ISO datetime string
}

/**
 * Selection property value (read format)
 */
export interface SelectionPropertyValue extends PropertyValueBase {
  type: 'selection';
  selection: Array<[string, string]>;
  value: string;
}

/**
 * Many2one property value (read format)
 */
export interface Many2onePropertyValue extends PropertyValueBase {
  type: 'many2one';
  comodel: string;
  value: number | false; // Record ID or false if not set
}

/**
 * Many2many property value (read format)
 */
export interface Many2manyPropertyValue extends PropertyValueBase {
  type: 'many2many';
  comodel: string;
  value: number[]; // Array of record IDs
}

/**
 * Tags property value (read format)
 */
export interface TagsPropertyValue extends PropertyValueBase {
  type: 'tags';
  value: string[]; // Array of tag strings
}

/**
 * Union type of all property values (read format)
 */
export type PropertyValue =
  | CharPropertyValue
  | IntegerPropertyValue
  | FloatPropertyValue
  | BooleanPropertyValue
  | DatePropertyValue
  | DateTimePropertyValue
  | SelectionPropertyValue
  | Many2onePropertyValue
  | Many2manyPropertyValue
  | TagsPropertyValue;

/**
 * Array of property values (read format)
 * 
 * This is what Odoo returns when reading a properties field.
 */
export type PropertiesReadFormat = PropertyValue[];

/**
 * Properties write format
 * 
 * When writing properties to Odoo, use a plain object with property names as keys.
 * Odoo accepts simple values without the full metadata.
 */
export type PropertiesWriteFormat = Record<string, PropertyValueType>;

/**
 * Type for property values when writing
 */
export type PropertyValueType =
  | string
  | number
  | boolean
  | number[] // for many2many
  | string[] // for tags
  | false; // for many2one when not set

/**
 * Helper to extract property value by name from read format
 * 
 * @param properties - Properties in read format (array)
 * @param propertyName - Name of the property to extract
 * @returns The property value, or undefined if not found
 */
export function getPropertyValue(
  properties: PropertiesReadFormat,
  propertyName: string
): PropertyValueType | undefined {
  const property = properties.find((p) => p.name === propertyName);
  return property ? property.value : undefined;
}

/**
 * Helper to convert properties from read format to write format
 * 
 * @param properties - Properties in read format (array)
 * @returns Properties in write format (object)
 */
export function propertiesToWriteFormat(
  properties: PropertiesReadFormat
): PropertiesWriteFormat {
  const result: PropertiesWriteFormat = {};
  for (const property of properties) {
    result[property.name] = property.value;
  }
  return result;
}

/**
 * Helper to get property definition by name
 * 
 * @param definitions - Array of property definitions
 * @param propertyName - Name of the property
 * @returns The property definition, or undefined if not found
 */
export function getPropertyDefinition(
  definitions: PropertiesDefinition,
  propertyName: string
): PropertyDefinition | undefined {
  return definitions.find((def) => def.name === propertyName);
}
