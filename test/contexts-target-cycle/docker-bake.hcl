group "default" {
  targets = ["t1", "t2"]
}

target "t1" {
  dockerfile = "Dockerfile"
  output = ["type=cacheonly"]
  contexts = {
    base = "target:t2"
  }
}

target "t2" {
  dockerfile = "Dockerfile"
  output = ["type=cacheonly"]
  contexts = {
    base = "target:t1"
  }
}
