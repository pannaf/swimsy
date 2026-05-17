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

    guard let date = ISO8601DateFormatter().date(from: dateISO) else {
      resolve(NSNull())
      return
    }

    let cal = Calendar.current
    let dayStart = cal.startOfDay(for: date)
    let dayEnd = cal.date(byAdding: .day, value: 1, to: dayStart)!

    var result: [String: Any] = [:]
    let group = DispatchGroup()

    // Swim workouts
    group.enter()
    let workoutPred = HKQuery.predicateForWorkouts(with: .swimming)
    let datePred = HKQuery.predicateForSamples(withStart: dayStart, end: dayEnd)
    let compoundPred = NSCompoundPredicate(andPredicateWithSubpredicates: [workoutPred, datePred])
    let workoutQuery = HKSampleQuery(sampleType: .workoutType(), predicate: compoundPred, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, _ in
      if let workout = samples?.first as? HKWorkout {
        result["distance"] = workout.totalDistance?.doubleValue(for: .yard()) ?? 0
        result["calories"] = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
        result["startDate"] = ISO8601DateFormatter().string(from: workout.startDate)
        result["endDate"] = ISO8601DateFormatter().string(from: workout.endDate)

        // Heart rate during swim
        let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let hrPred = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate)
        let hrQuery = HKSampleQuery(sampleType: hrType, predicate: hrPred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, hrSamples, _ in
          if let hrs = hrSamples as? [HKQuantitySample], !hrs.isEmpty {
            let values = hrs.map { $0.quantity.doubleValue(for: HKUnit(from: "count/min")) }
            result["avgHeartRate"] = Int(values.reduce(0, +) / Double(values.count))
            result["maxHeartRate"] = Int(values.max() ?? 0)
          }
          group.leave()
        }
        self.store.execute(hrQuery)
      } else {
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
          // AsleepCore, AsleepDeep, AsleepREM, AsleepUnspecified
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
      resolve(result.isEmpty ? NSNull() : result)
    }
  }
}
