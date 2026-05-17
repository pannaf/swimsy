Pod::Spec.new do |s|
  s.name           = "HealthKitBridge"
  s.version        = "1.0.0"
  s.summary        = "HealthKit bridge for Swimsy"
  s.homepage       = "https://github.com/example"
  s.license        = "MIT"
  s.author         = "Swimsy"
  s.platform       = :ios, "15.0"
  s.source         = { :path => "." }
  s.source_files   = "*.{swift,m,h}"
  s.dependency     "React-Core"
  s.frameworks     = "HealthKit"
end
