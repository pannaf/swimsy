import Foundation
import HealthKit
import React

@objc(HealthKitBridge)
class HealthKitBridge: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  private let store = HKHealthStore()

  @objc func isAvailable(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(HKHealthStore.isHealthDataAvailable())
  }

  @objc func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    let readTypes: Set<HKObjectType> = [
      HKObjectType.workoutType(),
      HKQuantityType.quantityType(forIdentifier: .heartRate)!,
      HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!,
      HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
      HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
      HKQuantityType.quantityType(forIdentifier: .vo2Max)!,
      HKQuantityType.quantityType(forIdentifier: .swimmingStrokeCount)!,
      HKQuantityType.quantityType(forIdentifier: .distanceSwimming)!,
      HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!,
    ]

    store.requestAuthorization(toShare: nil, read: readTypes) { success, error in
      resolve(success)
    }
  }

  @objc func getSwimDataForDate(_ dateISO: String,
                                 resolver resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(NSNull())
      return
    }

    // Parse date
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: dateISO)
    if date == nil {
      formatter.formatOptions = [.withInternetDateTime]
      date = formatter.date(from: dateISO)
    }
    if date == nil {
      let df = DateFormatter()
      df.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
      date = df.date(from: dateISO)
    }
    guard let date = date else {
      print("[HealthKit] Failed to parse date: \(dateISO)")
      resolve(NSNull())
      return
    }
    print("[HealthKit] Parsed date: \(date)")

    let cal = Calendar.current
    let dayStart = cal.date(byAdding: .day, value: -1, to: cal.startOfDay(for: date))!
    let dayEnd = cal.date(byAdding: .day, value: 2, to: cal.startOfDay(for: date))!

    print("[HealthKit] Querying swims from \(dayStart) to \(dayEnd)")

    var result: [String: Any] = [:]
    let group = DispatchGroup()

    // Swim workouts - find the one closest to the target date
    group.enter()
    let workoutPred = HKQuery.predicateForWorkouts(with: .swimming)
    let datePred = HKQuery.predicateForSamples(withStart: dayStart, end: dayEnd)
    let compoundPred = NSCompoundPredicate(andPredicateWithSubpredicates: [workoutPred, datePred])
    let workoutQuery = HKSampleQuery(sampleType: .workoutType(), predicate: compoundPred, limit: 20, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { [weak self] _, samples, error in
      print("[HealthKit] Swim query: \(samples?.count ?? 0) results, error: \(error?.localizedDescription ?? "none")")

      guard let swims = samples as? [HKWorkout], !swims.isEmpty else {
        print("[HealthKit] No swim workouts found for date range")
        group.leave()
        return
      }

      // Filter to Apple Watch workouts only
      let watchSwims = swims.filter { w in
        let source = w.sourceRevision.source.name
        let bundleId = w.sourceRevision.source.bundleIdentifier
        let isWatch = source.contains("Watch") || bundleId.hasPrefix("com.apple.health")
        print("[HealthKit] Workout source: \(source) (\(bundleId)) -> \(isWatch ? "Apple Watch" : "skipped")")
        return isWatch
      }

      guard !watchSwims.isEmpty else {
        print("[HealthKit] No Apple Watch swim workouts found (filtered out \(swims.count) non-Watch workouts)")
        group.leave()
        return
      }

      // Pick the swim workout closest to the target date
      let targetDay = cal.startOfDay(for: date)
      let workout = watchSwims.min(by: { a, b in
        abs(cal.startOfDay(for: a.startDate).timeIntervalSince(targetDay)) <
        abs(cal.startOfDay(for: b.startDate).timeIntervalSince(targetDay))
      })!

      print("[HealthKit] Found \(swims.count) swim workouts, picked: \(workout.startDate) to \(workout.endDate)")
      print("[HealthKit] totalDistance: \(workout.totalDistance?.doubleValue(for: .yard()) ?? 0)")
      print("[HealthKit] totalSwimmingStrokeCount: \(workout.totalSwimmingStrokeCount?.doubleValue(for: .count()) ?? 0)")

      result["calories"] = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
      result["startDate"] = ISO8601DateFormatter().string(from: workout.startDate)
      result["endDate"] = ISO8601DateFormatter().string(from: workout.endDate)
      result["duration"] = workout.duration

      // Get pool length from metadata
      if let metadata = workout.metadata {
        print("[HealthKit] Workout metadata: \(metadata)")
        if let lapLength = metadata[HKMetadataKeyLapLength] as? HKQuantity {
          result["poolLengthYards"] = lapLength.doubleValue(for: .yard())
          result["poolLengthMeters"] = lapLength.doubleValue(for: .meter())
        }
        if let strokeStyle = metadata[HKMetadataKeySwimmingStrokeStyle] as? NSNumber {
          result["strokeStyle"] = strokeStyle.intValue
        }
        if #available(iOS 16.0, *) {
          if let swolf = metadata[HKMetadataKeySWOLFScore] as? NSNumber {
            result["swolf"] = swolf.intValue
          }
        }
      }

      // Use totalDistance if available
      let totalDistanceYards = workout.totalDistance?.doubleValue(for: .yard()) ?? 0
      if totalDistanceYards > 0 {
        result["distance"] = totalDistanceYards
        print("[HealthKit] Using totalDistance: \(totalDistanceYards) yards")
      }

      // Use totalSwimmingStrokeCount if available
      let totalStrokes = workout.totalSwimmingStrokeCount?.doubleValue(for: .count()) ?? 0
      if totalStrokes > 0 {
        result["totalStrokes"] = Int(totalStrokes)
        print("[HealthKit] Using totalSwimmingStrokeCount: \(Int(totalStrokes))")
      }

      let innerGroup = DispatchGroup()

      // Query distanceSwimming samples associated with this workout
      innerGroup.enter()
      if let distType = HKQuantityType.quantityType(forIdentifier: .distanceSwimming) {
        let distPred = HKQuery.predicateForObjects(from: workout)
        let distQuery = HKSampleQuery(sampleType: distType, predicate: distPred, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, distSamples, distError in
          print("[HealthKit] distanceSwimming query error: \(distError?.localizedDescription ?? "none")")
          if let samples = distSamples as? [HKQuantitySample], !samples.isEmpty {
            let totalYards = samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: .yard()) }
            print("[HealthKit] distanceSwimming samples: \(samples.count), total: \(totalYards) yards")
            if totalYards > 0 {
              result["distance"] = totalYards
            }
            result["lapCount"] = samples.count
          } else {
            print("[HealthKit] No distanceSwimming samples from workout predicate, trying date range...")
            // Fallback: query by date range
            let dateRangePred = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate)
            let fallbackQuery = HKSampleQuery(sampleType: distType, predicate: dateRangePred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, fallbackSamples, _ in
              if let samples = fallbackSamples as? [HKQuantitySample], !samples.isEmpty {
                let totalYards = samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: .yard()) }
                print("[HealthKit] distanceSwimming (date fallback): \(samples.count) samples, \(totalYards) yards")
                if totalYards > 0 {
                  result["distance"] = totalYards
                }
                result["lapCount"] = samples.count
              } else {
                print("[HealthKit] No distanceSwimming samples found at all")
              }
              innerGroup.leave()
            }
            self?.store.execute(fallbackQuery)
            return
          }
          innerGroup.leave()
        }
        self?.store.execute(distQuery)
      } else {
        innerGroup.leave()
      }

      // Query swimmingStrokeCount samples associated with this workout
      innerGroup.enter()
      if let strokeType = HKQuantityType.quantityType(forIdentifier: .swimmingStrokeCount) {
        let strokePred = HKQuery.predicateForObjects(from: workout)
        let strokeQuery = HKSampleQuery(sampleType: strokeType, predicate: strokePred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, strokeSamples, _ in
          if let samples = strokeSamples as? [HKQuantitySample], !samples.isEmpty {
            let total = samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: .count()) }
            result["totalStrokes"] = Int(total)
            print("[HealthKit] strokeCount samples: \(samples.count), total: \(Int(total))")
          } else {
            print("[HealthKit] No stroke samples from workout predicate")
          }
          innerGroup.leave()
        }
        self?.store.execute(strokeQuery)
      } else {
        innerGroup.leave()
      }

      // Heart rate during swim
      innerGroup.enter()
      let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
      let hrPred = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate)
      let hrQuery = HKSampleQuery(sampleType: hrType, predicate: hrPred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, hrSamples, _ in
        if let hrs = hrSamples as? [HKQuantitySample], !hrs.isEmpty {
          let values = hrs.map { $0.quantity.doubleValue(for: HKUnit(from: "count/min")) }
          result["avgHeartRate"] = Int(values.reduce(0, +) / Double(values.count))
          result["maxHeartRate"] = Int(values.max() ?? 0)
        }
        innerGroup.leave()
      }
      self?.store.execute(hrQuery)

      innerGroup.notify(queue: .global()) {
        group.leave()
      }
    }
    store.execute(workoutQuery)

    // Resting HR
    group.enter()
    let rhrType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!
    let rhrPred = HKQuery.predicateForSamples(withStart: cal.date(byAdding: .day, value: -7, to: dayStart)!, end: dayEnd)
    let rhrQuery = HKSampleQuery(sampleType: rhrType, predicate: rhrPred, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, _ in
      if let sample = samples?.first as? HKQuantitySample {
        result["restingHeartRate"] = Int(sample.quantity.doubleValue(for: HKUnit(from: "count/min")))
      }
      group.leave()
    }
    store.execute(rhrQuery)

    // HRV
    group.enter()
    let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
    let hrvPred = HKQuery.predicateForSamples(withStart: cal.date(byAdding: .day, value: -7, to: dayStart)!, end: dayEnd)
    let hrvQuery = HKSampleQuery(sampleType: hrvType, predicate: hrvPred, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, _ in
      if let sample = samples?.first as? HKQuantitySample {
        result["hrv"] = sample.quantity.doubleValue(for: .secondUnit(with: .milli))
      }
      group.leave()
    }
    store.execute(hrvQuery)

    // VO2 Max
    group.enter()
    let vo2Type = HKQuantityType.quantityType(forIdentifier: .vo2Max)!
    let vo2Pred = HKQuery.predicateForSamples(withStart: cal.date(byAdding: .day, value: -30, to: dayStart)!, end: dayEnd)
    let vo2Query = HKSampleQuery(sampleType: vo2Type, predicate: vo2Pred, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, _ in
      if let sample = samples?.first as? HKQuantitySample {
        result["vo2Max"] = sample.quantity.doubleValue(for: HKUnit(from: "ml/kg*min"))
      }
      group.leave()
    }
    store.execute(vo2Query)

    // Sleep (night before)
    group.enter()
    let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
    let sleepStart = cal.date(byAdding: .hour, value: -18, to: dayStart)!
    let sleepPred = HKQuery.predicateForSamples(withStart: sleepStart, end: dayStart)
    let sleepQuery = HKSampleQuery(sampleType: sleepType, predicate: sleepPred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
      if let sleeps = samples as? [HKCategorySample], !sleeps.isEmpty {
        var totalSleep: TimeInterval = 0
        for s in sleeps {
          if s.value != HKCategoryValueSleepAnalysis.awake.rawValue &&
             s.value != HKCategoryValueSleepAnalysis.inBed.rawValue {
            totalSleep += s.endDate.timeIntervalSince(s.startDate)
          }
        }
        if totalSleep > 0 {
          result["sleepHours"] = round(totalSleep / 3600.0 * 10) / 10
        }
      }
      group.leave()
    }
    store.execute(sleepQuery)

    group.notify(queue: .main) {
      print("[HealthKit] Final result keys: \(result.keys.sorted())")
      print("[HealthKit] Final result: \(result)")
      resolve(result.isEmpty ? NSNull() : result)
    }
  }
}
