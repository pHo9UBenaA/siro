import * as vb from 'valibot';
import { ConfigError } from '../../shared/errors.ts';
import { isPlainRecord } from '../../shared/records.ts';

// Validate only fields consumed by siro; retain other manifest data unchanged.
const PackageJsonSchema = vb.looseObject({
  files: vb.optional(vb.array(vb.string())),
  name: vb.optional(vb.string()),
  packageManager: vb.optional(vb.string()),
  private: vb.optional(vb.boolean()),
  publishConfig: vb.optional(
    vb.looseObject({
      access: vb.optional(vb.picklist(['public', 'restricted'])),
    }),
  ),
  trustedDependencies: vb.optional(vb.array(vb.string())),
});

export type PackageJson = vb.InferOutput<typeof PackageJsonSchema>;

export const parsePackageJson = (value: unknown): PackageJson => {
  if (!isPlainRecord(value)) throw new ConfigError('package.json: expected an object at the root.');
  const result = vb.safeParse(PackageJsonSchema, value);
  if (result.success) return result.output;
  const issue = result.issues[0];
  const field = vb.getDotPath(issue);
  throw new ConfigError(`package.json: ${field ? `${field}: ` : ''}${issue.message}`);
};
