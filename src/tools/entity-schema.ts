import { z } from 'zod';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const EntitySchemaSchema = z.object({
  site: z.string().describe('DDEV site name'),
});

export type EntitySchemaParams = z.infer<typeof EntitySchemaSchema>;

export async function entitySchema(
  params: EntitySchemaParams,
  siteManager: SiteManager,
  redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const ddev = siteManager.getDdev();

  // Get content types
  const contentTypesResult = await ddev.drush(site.path, 'sql:query', [
    "SELECT type, name, description FROM node_type ORDER BY type",
  ]);

  // Get fields
  const fieldsResult = await ddev.drush(site.path, 'sql:query', [
    "SELECT fc.id, fc.field_name, fc.type, fc.entity_type, fci.bundle FROM config AS fc JOIN config AS fci ON fci.name LIKE CONCAT('field.field.', fc.name) WHERE fc.name LIKE 'field.storage.%' LIMIT 200",
  ]);

  // Alternative: use drush to get entity type info
  const entityInfoResult = await ddev.drush(site.path, 'php:eval', [
    `
    $types = \\Drupal::entityTypeManager()->getDefinitions();
    $result = [];
    foreach (['node', 'taxonomy_term', 'paragraph', 'media', 'block_content'] as $entity_type_id) {
      if (isset($types[$entity_type_id])) {
        $type = $types[$entity_type_id];
        $bundles = \\Drupal::service('entity_type.bundle.info')->getBundleInfo($entity_type_id);
        $result[$entity_type_id] = [
          'label' => (string) $type->getLabel(),
          'bundles' => array_keys($bundles),
        ];
        foreach ($bundles as $bundle_id => $bundle_info) {
          $fields = \\Drupal::service('entity_field.manager')->getFieldDefinitions($entity_type_id, $bundle_id);
          $custom_fields = [];
          foreach ($fields as $field_name => $field) {
            if (strpos($field_name, 'field_') === 0) {
              $custom_fields[$field_name] = [
                'type' => $field->getType(),
                'label' => (string) $field->getLabel(),
                'required' => $field->isRequired(),
              ];
            }
          }
          $result[$entity_type_id]['bundle_fields'][$bundle_id] = $custom_fields;
        }
      }
    }
    echo json_encode($result, JSON_PRETTY_PRINT);
    `,
  ]);

  let entityInfo: Record<string, unknown> = {};
  try {
    entityInfo = JSON.parse(entityInfoResult.stdout);
  } catch {
    // Fallback: return raw output
    entityInfo = { raw: redactor.redact(entityInfoResult.stdout) };
  }

  // Get vocabularies
  const vocabResult = await ddev.drush(site.path, 'php:eval', [
    `
    $vocabs = \\Drupal::entityTypeManager()->getStorage('taxonomy_vocabulary')->loadMultiple();
    $result = [];
    foreach ($vocabs as $vocab) {
      $result[] = ['vid' => $vocab->id(), 'name' => $vocab->label(), 'description' => $vocab->getDescription()];
    }
    echo json_encode($result, JSON_PRETTY_PRINT);
    `,
  ]);

  let vocabularies: unknown[] = [];
  try {
    vocabularies = JSON.parse(vocabResult.stdout);
  } catch {
    vocabularies = [];
  }

  return JSON.stringify({
    site: params.site,
    entity_types: entityInfo,
    vocabularies,
  }, null, 2);
}
