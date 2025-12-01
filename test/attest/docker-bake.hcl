group "default" {
  targets = ["t1", "t2", "t3"]
}

target "t1" {
  target = "t1"
}

target "t2" {
  target = "t2"
  attest = ["type=provenance,mode=min"]
}

target "t3" {
  target = "t3"
  attest = ["type=sbom"]
}
