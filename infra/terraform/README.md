# Honeypot Terraform

Minimal Cloud Run deployment skeleton for the Honeypot backend.

## Apply

```bash
terraform init
terraform apply \
  -var="project_id=your-project" \
  -var="image=asia-northeast3-docker.pkg.dev/your-project/apps/honeypot:latest"
```

Use `env` to inject Azure credentials, `ALLOWED_ORIGINS`, and any runtime config needed for live mode.
