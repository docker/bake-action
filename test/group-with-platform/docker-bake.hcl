group "validate" {
  targets = ["lint", "lint-gopls", "validate-vendor", "validate-docs"]
}

target "lint" {
  dockerfile = "./hack/dockerfiles/lint.Dockerfile"
  output = ["type=cacheonly"]
  platforms = [
    "darwin/amd64",
    "darwin/arm64",
    "linux/amd64",
    "linux/arm64",
    "linux/s390x",
    "linux/ppc64le",
    "linux/riscv64",
    "windows/amd64",
    "windows/arm64"
  ]
}

target "lint-gopls" {
  inherits = ["lint"]
  target = "gopls-analyze"
}

target "validate-vendor" {
  dockerfile = "./hack/dockerfiles/vendor.Dockerfile"
  target = "validate"
  output = ["type=cacheonly"]
}

target "validate-docs" {
  dockerfile = "./hack/dockerfiles/docs.Dockerfile"
  target = "validate"
  output = ["type=cacheonly"]
}
