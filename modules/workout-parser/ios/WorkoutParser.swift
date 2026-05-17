import Foundation
import UIKit
import Vision
import React
import FoundationModels

@objc(WorkoutParser)
class WorkoutParser: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  // MARK: - OCR using Vision

  @objc func extractText(_ imageUri: String,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: imageUri),
          let imageData = try? Data(contentsOf: url),
          let image = UIImage(data: imageData),
          let cgImage = image.cgImage else {
      reject("ERR", "Could not load image", nil)
      return
    }

    let request = VNRecognizeTextRequest { request, error in
      if let error = error {
        reject("ERR", error.localizedDescription, error)
        return
      }
      let text = (request.results as? [VNRecognizedTextObservation])?
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n") ?? ""
      resolve(text)
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try handler.perform([request])
      } catch {
        reject("ERR", error.localizedDescription, error)
      }
    }
  }

  // MARK: - Parse workout text

  @objc func parseWorkoutText(_ text: String,
                               resolver resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 26.0, *) {
      parseWithLLM(text: text, resolve: resolve, reject: reject)
    } else {
      let result = regexParse(text: text)
      resolve(["method": "regex", "result": result])
    }
  }

  // MARK: - Foundation Models (iOS 26+)

  @available(iOS 26.0, *)
  private func parseWithLLM(text: String,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let session = LanguageModelSession()
        let prompt = """
        Parse this swim workout into JSON. Return ONLY a JSON array, no explanation.

        Each set has "groups". Each group has "rounds" and "lines". Lines done as a repeating group share one group with rounds > 1. Lines done once go in a separate group with rounds: 1.

        Example: "2× (25+50+75) + 100 ez" =
        [{"groups":[
          {"rounds":2,"lines":[{"reps":1,"distance":25,"stroke":"free","interval_seconds":null},{"reps":1,"distance":50,"stroke":"free","interval_seconds":null},{"reps":1,"distance":75,"stroke":"free","interval_seconds":null}]},
          {"rounds":1,"lines":[{"reps":1,"distance":100,"stroke":"free","interval_seconds":null}]}
        ]}]
        The (25+50+75) group is done 2 times through: 25,50,75,25,50,75. Then 100 ez once.

        Example: "6x100 free @1:30" =
        [{"groups":[{"rounds":1,"lines":[{"reps":6,"distance":100,"stroke":"free","interval_seconds":90}]}]}]

        Example: "300 warmup" =
        [{"groups":[{"rounds":1,"lines":[{"reps":1,"distance":300,"stroke":"free","interval_seconds":null}]}]}]

        Rules:
        - (25+50+75) = three SEPARATE distances, NOT 150
        - "ez"/"EZ" = easy, still "free" stroke
        - "B+5"/"Base+5" = null interval_seconds
        - "SO 1:00"/"@1:00" = 60. "1:30" = 90. ":45" = 45.
        - "K/S" = kick, "FT"/"FTO" = free, "BK" = back, "BR" = breast, "FL" = fly
        - Default stroke is "free"

        Format: [{"groups":[{"rounds":N,"lines":[{"reps":N,"distance":N,"stroke":"free","interval_seconds":N|null}]}]}]

        OCR text:
        \(text)
        """

        let response = try await session.respond(to: prompt)
        let responseText = response.content

        // Extract JSON array from response
        if let jsonStart = responseText.firstIndex(of: "["),
           let jsonEnd = responseText.lastIndex(of: "]") {
          let jsonStr = String(responseText[jsonStart...jsonEnd])
          // Validate it's actual JSON
          if let data = jsonStr.data(using: .utf8),
             let _ = try? JSONSerialization.jsonObject(with: data) {
            resolve(["method": "llm", "result": jsonStr, "llmRaw": responseText])
            return
          }
        }
        // Fallback to regex if LLM response wasn't valid JSON
        let result = self.regexParse(text: text)
        resolve(["method": "regex (llm failed to produce JSON)", "result": result, "llmRaw": responseText])
      } catch {
        // Fallback to regex on any error
        let result = self.regexParse(text: text)
        resolve(["method": "regex (llm error: \(error.localizedDescription))", "result": result])
      }
    }
  }

  // MARK: - Regex fallback

  private func regexParse(text: String) -> String {
    var sets: [[String: Any]] = []

    var cleaned = text
      .replacingOccurrences(of: "×", with: "x")
      .replacingOccurrences(of: "X", with: "x")
      .replacingOccurrences(of: "SO", with: "@")
      .replacingOccurrences(of: "so", with: "@")
      .replacingOccurrences(of: "So", with: "@")

    let lines = cleaned.components(separatedBy: .newlines)

    let setPattern = #"(\d+)\s*x\s*(\d+)"#
    let soloPattern = #"^\s*(\d{2,3})\s"#
    let intervalPattern = #"@?\s*(\d+)[:\.](\d{2})"#

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.isEmpty { continue }

      if let setRegex = try? NSRegularExpression(pattern: setPattern, options: []) {
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        let matches = setRegex.matches(in: trimmed, options: [], range: range)

        var lineItems: [[String: Any]] = []
        for match in matches {
          let repsStr = (trimmed as NSString).substring(with: match.range(at: 1))
          let distStr = (trimmed as NSString).substring(with: match.range(at: 2))

          guard let reps = Int(repsStr), let distance = Int(distStr),
                distance >= 25 && distance <= 1000 && reps >= 1 && reps <= 50 else { continue }

          var interval: Any = NSNull()
          if let ivRegex = try? NSRegularExpression(pattern: intervalPattern, options: []) {
            let ivMatches = ivRegex.matches(in: trimmed, options: [], range: range)
            if let ivMatch = ivMatches.first {
              let mins = Int((trimmed as NSString).substring(with: ivMatch.range(at: 1))) ?? 0
              let secs = Int((trimmed as NSString).substring(with: ivMatch.range(at: 2))) ?? 0
              interval = mins * 60 + secs
            }
          }

          let stroke = detectStroke(in: trimmed)

          lineItems.append([
            "reps": reps,
            "distance": distance,
            "stroke": stroke,
            "interval_seconds": interval
          ])
        }

        if !lineItems.isEmpty {
          sets.append(["groups": [["rounds": 1, "lines": lineItems]]])
          continue
        }
      }

      if let soloRegex = try? NSRegularExpression(pattern: soloPattern, options: []) {
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        if let match = soloRegex.firstMatch(in: trimmed, options: [], range: range) {
          let distStr = (trimmed as NSString).substring(with: match.range(at: 1))
          if let distance = Int(distStr), distance >= 25 && distance <= 1000 {
            let stroke = detectStroke(in: trimmed)
            sets.append(["groups": [["rounds": 1, "lines": [[
              "reps": 1,
              "distance": distance,
              "stroke": stroke,
              "interval_seconds": NSNull()
            ] as [String: Any]]] as [String: Any]]])
          }
        }
      }
    }

    guard let data = try? JSONSerialization.data(withJSONObject: sets),
          let json = String(data: data, encoding: .utf8) else {
      return "[]"
    }
    return json
  }

  private func detectStroke(in text: String) -> String {
    let lower = text.lowercased()
    let strokeKeywords: [(keywords: [String], stroke: String)] = [
      (["kick", "k/s", "kk", "kik"], "kick"),
      (["back", "bk"], "back"),
      (["breast", "br"], "breast"),
      (["fly", "fl", "butterfly"], "fly"),
      (["drill", "dr"], "drill"),
      (["im", "i.m"], "IM"),
      (["free", "fr", "ft"], "free"),
    ]
    for entry in strokeKeywords {
      for keyword in entry.keywords {
        if lower.contains(keyword) {
          return entry.stroke
        }
      }
    }
    return "free"
  }
}
