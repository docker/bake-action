group "validate" {
  targets = ["lint", "validate-vendor", "validate-doctoc"]
}

target "lint" {
  name = "lint-${buildtags.name}"
  dockerfile = "./hack/dockerfiles/lint.Dockerfile"
  target = buildtags.target
  output = ["type=cacheonly"]
  matrix = {
    buildtags = [
      { name = "default", tags = "", target = "golangci-lint" },
      { name = "labs", tags = "dfrunsecurity dfparents", target = "golangci-lint" },
      { name = "nydus", tags = "nydus", target = "golangci-lint" },
      { name = "yaml", tags = "", target = "yamllint" },
      { name = "proto", tags = "", target = "protolint" },
    ]
  }
}

target "validate-vendor" {
  dockerfile = "./hack/dockerfiles/vendor.Dockerfile"
  target = "validate"
  output = ["type=cacheonly"]
}

target "validate-doctoc" {
  dockerfile = "./hack/dockerfiles/doctoc.Dockerfile"
  target = "validate-toc"
  output = ["type=cacheonly"]
}
