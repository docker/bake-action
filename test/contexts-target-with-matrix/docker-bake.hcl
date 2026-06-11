function "platform_name" {
  params = [platform]
  result = replace(platform, "/", "-")
}

group "default" {
  targets = ["t2", "t3", "t4"]
}

target "_common" {
  dockerfile = "./Dockerfile"
  output = ["type=cacheonly"]
}

target "base" {
  inherits = ["_common"]
}

target "t1" {
  inherits = ["_common"]
  name = "t1_${platform_name(platform)}"
  matrix = {
    platform = [
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
  platforms = [platform]
  contexts = {
    base = "target:base"
  }
}

target "t2" {
  inherits = ["_common"]
  name = "t2_${platform_name(platform)}"
  matrix = {
    platform = [
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
  platforms = [platform]
  contexts = {
    t1 = "target:t1_${platform_name(platform)}"
  }
}

target "t3" {
  inherits = ["_common"]
  platforms = ["linux/arm64"]
  contexts = {
    base = "target:base"
    t2 = "target:t2_linux-arm64"
  }
}

target "t4" {
  inherits = ["_common"]
  contexts = {
    base = "target:base"
  }
}
