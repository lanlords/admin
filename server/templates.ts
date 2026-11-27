import path from 'node:path'
import nunjucks from 'nunjucks'
import type { TemplateVars } from '../shared/types.js'
import { resolveTemplatePath } from './config.js'

export class TemplateRenderer {
  private readonly templatesDir: string

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir
    nunjucks.configure(templatesDir, {
      autoescape: false,
      throwOnUndefined: false,
      noCache: true,
    })
  }

  render(template: string, vars: TemplateVars): string {
    const templatePath = resolveTemplatePath(template, this.templatesDir)
    const relative = path.relative(this.templatesDir, templatePath)
    return nunjucks.render(relative, vars)
  }
}
