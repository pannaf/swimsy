Pod::Spec.new do |s|
  s.name           = "WorkoutParser"
  s.version        = "1.0.0"
  s.summary        = "On-device workout photo parser"
  s.homepage       = "https://github.com/example"
  s.license        = "MIT"
  s.author         = "Swimsy"
  s.platform       = :ios, "15.0"
  s.source         = { :path => "." }
  s.source_files   = "*.{swift,m,h}"
  s.dependency     "React-Core"
  s.frameworks     = "Vision", "UIKit"
  s.weak_frameworks = "FoundationModels"
end
